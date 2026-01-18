'use client';

import { Card } from '@/components/ui';
import type { MealItem, MealType } from '@/lib/store';
import clsx from 'clsx';

interface MealCardProps {
  meal: MealItem;
  mealType: MealType;
  compact?: boolean;
  onClick?: () => void;
}

const mealTypeColors: Record<MealType, string> = {
  breakfast: 'bg-yellow-100 text-yellow-700',
  lunch: 'bg-orange-100 text-orange-700',
  dinner: 'bg-purple-100 text-purple-700',
  snack: 'bg-green-100 text-green-700',
};

const mealTypeIcons: Record<MealType, React.ReactNode> = {
  breakfast: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
    </svg>
  ),
  lunch: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  dinner: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  snack: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454" />
    </svg>
  ),
};

export function MealCard({ meal, mealType, compact = false, onClick }: MealCardProps) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left group"
      >
        <Card
          hoverable
          padding="sm"
          className="h-full min-h-[80px] transition-all duration-200 group-hover:shadow-md"
        >
          <div className="space-y-1">
            <div className={clsx(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              mealTypeColors[mealType]
            )}>
              {mealTypeIcons[mealType]}
            </div>
            <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
              {meal.name}
            </h4>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {meal.prepTimeMinutes} min
            </div>
          </div>
        </Card>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left group"
    >
      <Card
        hoverable
        className="overflow-hidden transition-all duration-200 group-hover:shadow-md"
      >
        {meal.imageUrl && (
          <div className="relative h-32 -mx-5 -mt-5 mb-4 overflow-hidden">
            <img
              src={meal.imageUrl}
              alt={meal.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className={clsx(
              'absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              mealTypeColors[mealType]
            )}>
              {mealTypeIcons[mealType]}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {!meal.imageUrl && (
            <div className={clsx(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              mealTypeColors[mealType]
            )}>
              {mealTypeIcons[mealType]}
            </div>
          )}

          <h3 className="font-semibold text-gray-900">{meal.name}</h3>
          <p className="text-sm text-gray-500 line-clamp-2">{meal.description}</p>

          <div className="flex items-center gap-4 pt-2 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {meal.prepTimeMinutes} min
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {meal.servings} pers.
            </div>
          </div>
        </div>
      </Card>
    </button>
  );
}
