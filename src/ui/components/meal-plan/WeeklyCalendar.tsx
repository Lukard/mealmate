'use client';

import { useState } from 'react';
import { Card } from '@/components/ui';
import { MealCard } from './MealCard';
import type { WeeklyMealPlan, DayPlan, MealType } from '@/lib/store';
import clsx from 'clsx';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface WeeklyCalendarProps {
  mealPlan: WeeklyMealPlan;
  onMealClick?: (day: DayOfWeek, mealType: MealType) => void;
}

const dayLabels: Record<DayOfWeek, { short: string; full: string }> = {
  monday: { short: 'Lun', full: 'Lunes' },
  tuesday: { short: 'Mar', full: 'Martes' },
  wednesday: { short: 'Mie', full: 'Miercoles' },
  thursday: { short: 'Jue', full: 'Jueves' },
  friday: { short: 'Vie', full: 'Viernes' },
  saturday: { short: 'Sab', full: 'Sabado' },
  sunday: { short: 'Dom', full: 'Domingo' },
};

const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Merienda',
};

const daysOfWeek: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function WeeklyCalendar({ mealPlan, onMealClick }: WeeklyCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('monday');
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

  // Get meals that are included in the plan
  const getMealTypes = (): MealType[] => {
    const types: MealType[] = [];
    const sampleDay = mealPlan.days.monday;
    if (sampleDay.breakfast) types.push('breakfast');
    if (sampleDay.lunch) types.push('lunch');
    if (sampleDay.dinner) types.push('dinner');
    if (sampleDay.snack) types.push('snack');
    return types;
  };

  const mealTypes = getMealTypes();

  return (
    <div className="space-y-4">
      {/* View toggle - mobile */}
      <div className="md:hidden flex justify-center">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setViewMode('day')}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              viewMode === 'day' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
            )}
          >
            Por dia
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              viewMode === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
            )}
          >
            Semana
          </button>
        </div>
      </div>

      {/* Day selector - mobile day view */}
      {viewMode === 'day' && (
        <div className="md:hidden flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
          {daysOfWeek.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={clsx(
                'flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-colors',
                selectedDay === day
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {dayLabels[day].short}
            </button>
          ))}
        </div>
      )}

      {/* Mobile day view */}
      {viewMode === 'day' && (
        <div className="md:hidden space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {dayLabels[selectedDay].full}
          </h3>
          {mealTypes.map((mealType) => {
            const meal = mealPlan.days[selectedDay][mealType];
            if (!meal) return null;
            return (
              <MealCard
                key={`${selectedDay}-${mealType}`}
                meal={meal}
                mealType={mealType}
                onClick={() => onMealClick?.(selectedDay, mealType)}
              />
            );
          })}
        </div>
      )}

      {/* Desktop and mobile week view */}
      <div className={clsx('md:block', viewMode === 'day' ? 'hidden' : 'block')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr>
                <th className="p-2 text-left text-sm font-medium text-gray-500 w-24"></th>
                {daysOfWeek.map((day) => (
                  <th key={day} className="p-2 text-center">
                    <span className="block text-sm font-semibold text-gray-900">
                      {dayLabels[day].short}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mealTypes.map((mealType) => (
                <tr key={mealType} className="border-t border-gray-100">
                  <td className="p-2 text-sm font-medium text-gray-500 align-top">
                    {mealTypeLabels[mealType]}
                  </td>
                  {daysOfWeek.map((day) => {
                    const meal = mealPlan.days[day][mealType];
                    return (
                      <td key={`${day}-${mealType}`} className="p-2 align-top">
                        {meal ? (
                          <MealCard
                            meal={meal}
                            mealType={mealType}
                            compact
                            onClick={() => onMealClick?.(day, mealType)}
                          />
                        ) : (
                          <div className="h-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                            <span className="text-xs text-gray-400">-</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly summary */}
      <Card className="bg-primary-50 border-primary-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary-800">Resumen semanal</p>
            <p className="text-sm text-primary-600">
              {mealTypes.length * 7} comidas planificadas
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-primary-800">Coste estimado</p>
            <p className="text-2xl font-bold text-primary-700">
              {mealPlan.estimatedCost.toFixed(2)} EUR
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
