'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import { useStore, type DietaryRestriction } from '@/lib/store';
import clsx from 'clsx';

interface DietaryOption {
  id: DietaryRestriction;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const dietaryOptions: DietaryOption[] = [
  {
    id: 'none',
    label: 'Sin restricciones',
    description: 'Como de todo',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  {
    id: 'vegetarian',
    label: 'Vegetariano',
    description: 'Sin carne ni pescado',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: 'vegan',
    label: 'Vegano',
    description: 'Sin productos de origen animal',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    id: 'gluten-free',
    label: 'Sin gluten',
    description: 'Apto para celiacos',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
  {
    id: 'dairy-free',
    label: 'Sin lactosa',
    description: 'Sin productos lacteos',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    id: 'nut-free',
    label: 'Sin frutos secos',
    description: 'Alergia a frutos secos',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    id: 'halal',
    label: 'Halal',
    description: 'Conforme a la ley islamica',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
  {
    id: 'kosher',
    label: 'Kosher',
    description: 'Conforme a la ley judia',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
];

interface DietaryPreferencesProps {
  onNext: () => void;
}

export function DietaryPreferences({ onNext }: DietaryPreferencesProps) {
  const { answers, setDietaryAnswers } = useStore();
  const [selected, setSelected] = useState<DietaryRestriction[]>(answers.dietary ?? []);

  useEffect(() => {
    setDietaryAnswers(selected);
  }, [selected, setDietaryAnswers]);

  const toggleOption = (id: DietaryRestriction) => {
    if (id === 'none') {
      setSelected(['none']);
      return;
    }

    setSelected((prev) => {
      // Remove 'none' if selecting another option
      const filtered = prev.filter((item) => item !== 'none');

      if (filtered.includes(id)) {
        return filtered.filter((item) => item !== id);
      } else {
        return [...filtered, id];
      }
    });
  };

  const isSelected = (id: DietaryRestriction) => selected.includes(id);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Restricciones alimentarias</h2>
        <p className="text-gray-600 mt-2">
          Selecciona todas las que apliquen a tu hogar
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {dietaryOptions.map((option) => (
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

      {selected.length > 0 && !selected.includes('none') && (
        <Card className="bg-yellow-50 border-yellow-200 p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Restricciones seleccionadas: {selected.length}
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Filtraremos las recetas para cumplir con todas tus restricciones
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
