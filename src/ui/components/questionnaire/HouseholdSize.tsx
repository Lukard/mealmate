'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import { useStore, type HouseholdInfo } from '@/lib/store';

interface HouseholdSizeProps {
  onNext: () => void;
}

export function HouseholdSize({ onNext }: HouseholdSizeProps) {
  const { answers, setHouseholdAnswers } = useStore();
  const [adults, setAdults] = useState(answers.household?.adults ?? 2);
  const [children, setChildren] = useState(answers.household?.children ?? 0);

  useEffect(() => {
    setHouseholdAnswers({ adults, children });
  }, [adults, children, setHouseholdAnswers]);

  const adjustCount = (type: 'adults' | 'children', delta: number) => {
    if (type === 'adults') {
      const newValue = Math.max(1, Math.min(10, adults + delta));
      setAdults(newValue);
    } else {
      const newValue = Math.max(0, Math.min(10, children + delta));
      setChildren(newValue);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Tu hogar</h2>
        <p className="text-gray-600 mt-2">
          Cuantas personas comen habitualmente en casa?
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Adults counter */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-primary-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Adultos</h3>
                  <p className="text-sm text-gray-500">Mayores de 14 anos</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => adjustCount('adults', -1)}
                disabled={adults <= 1}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-2xl font-bold text-gray-900 w-8 text-center">{adults}</span>
              <button
                type="button"
                onClick={() => adjustCount('adults', 1)}
                disabled={adults >= 10}
                className="w-10 h-10 rounded-full bg-primary-100 hover:bg-primary-200 text-primary-600 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </Card>

        {/* Children counter */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-accent-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-accent-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Ninos</h3>
                  <p className="text-sm text-gray-500">Menores de 14 anos</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => adjustCount('children', -1)}
                disabled={children <= 0}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-2xl font-bold text-gray-900 w-8 text-center">{children}</span>
              <button
                type="button"
                onClick={() => adjustCount('children', 1)}
                disabled={children >= 10}
                className="w-10 h-10 rounded-full bg-accent-100 hover:bg-accent-200 text-accent-600 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Summary */}
      <Card className="bg-primary-50 border-primary-200 p-4">
        <div className="flex items-center justify-center gap-2 text-primary-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <span className="font-medium">
            Total: {adults + children} {adults + children === 1 ? 'persona' : 'personas'}
          </span>
        </div>
      </Card>
    </div>
  );
}
