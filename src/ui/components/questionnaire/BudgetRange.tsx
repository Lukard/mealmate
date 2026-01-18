'use client';

import { useState, useEffect } from 'react';
import { Card, Input } from '@/components/ui';
import { useStore } from '@/lib/store';
import clsx from 'clsx';

interface BudgetPreset {
  id: string;
  label: string;
  description: string;
  amount: number;
}

const budgetPresets: BudgetPreset[] = [
  { id: 'economico', label: 'Economico', description: 'Aprox. 50-70 EUR/semana', amount: 60 },
  { id: 'moderado', label: 'Moderado', description: 'Aprox. 70-100 EUR/semana', amount: 85 },
  { id: 'comodo', label: 'Comodo', description: 'Aprox. 100-150 EUR/semana', amount: 125 },
  { id: 'premium', label: 'Premium', description: 'Mas de 150 EUR/semana', amount: 175 },
];

interface BudgetRangeProps {
  onNext: () => void;
}

export function BudgetRange({ onNext }: BudgetRangeProps) {
  const { answers, setBudgetAnswers } = useStore();
  const [budget, setBudget] = useState(answers.budget?.weeklyBudget ?? 100);
  const [preferCheaper, setPreferCheaper] = useState(answers.budget?.preferCheaper ?? false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    setBudgetAnswers({ weeklyBudget: budget, preferCheaper });
  }, [budget, preferCheaper, setBudgetAnswers]);

  const selectPreset = (preset: BudgetPreset) => {
    setSelectedPreset(preset.id);
    setBudget(preset.amount);
    setCustomMode(false);
  };

  const handleCustomBudget = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 30 && numValue <= 500) {
      setBudget(numValue);
      setSelectedPreset(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Presupuesto semanal</h2>
        <p className="text-gray-600 mt-2">
          Cuanto quieres gastar en comida a la semana?
        </p>
      </div>

      {/* Budget presets */}
      <div className="grid gap-3 md:grid-cols-2">
        {budgetPresets.map((preset) => (
          <Card
            key={preset.id}
            hoverable
            selected={selectedPreset === preset.id && !customMode}
            onClick={() => selectPreset(preset)}
            className={clsx(
              'p-4 cursor-pointer transition-all duration-200',
              selectedPreset === preset.id && !customMode && 'bg-primary-50'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{preset.label}</h3>
                <p className="text-sm text-gray-500">{preset.description}</p>
              </div>
              <div
                className={clsx(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                  selectedPreset === preset.id && !customMode
                    ? 'bg-primary-600 border-primary-600'
                    : 'border-gray-300'
                )}
              >
                {selectedPreset === preset.id && !customMode && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Custom budget slider */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Ajuste personalizado</h3>
          <button
            type="button"
            onClick={() => setCustomMode(!customMode)}
            className={clsx(
              'text-sm font-medium transition-colors',
              customMode ? 'text-primary-600' : 'text-gray-500 hover:text-primary-600'
            )}
          >
            {customMode ? 'Usando modo personalizado' : 'Personalizar'}
          </button>
        </div>

        <div className="space-y-4">
          {/* Slider */}
          <div>
            <input
              type="range"
              min="30"
              max="300"
              step="5"
              value={budget}
              onChange={(e) => {
                handleCustomBudget(e.target.value);
                setCustomMode(true);
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>30 EUR</span>
              <span>300 EUR</span>
            </div>
          </div>

          {/* Current value display */}
          <div className="text-center">
            <span className="text-4xl font-bold text-primary-600">{budget}</span>
            <span className="text-xl text-gray-600 ml-1">EUR/semana</span>
          </div>

          {/* Per person estimate */}
          {answers.household && (
            <div className="text-center text-sm text-gray-500">
              Aproximadamente{' '}
              <span className="font-medium">
                {(budget / (answers.household.adults + answers.household.children) / 7).toFixed(2)} EUR
              </span>{' '}
              por persona/dia
            </div>
          )}
        </div>
      </Card>

      {/* Prefer cheaper toggle */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Priorizar precios bajos</h3>
            <p className="text-sm text-gray-500">
              Buscaremos las opciones mas economicas aunque sean marcas blancas
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preferCheaper}
            onClick={() => setPreferCheaper(!preferCheaper)}
            className={clsx(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              preferCheaper ? 'bg-primary-600' : 'bg-gray-200'
            )}
          >
            <span
              className={clsx(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                preferCheaper ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </Card>
    </div>
  );
}
