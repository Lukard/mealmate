'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import { useStore } from '@/lib/store';

const MAX_CHARACTERS = 500;

interface AdditionalNotesProps {
  onNext: () => void;
}

export function AdditionalNotes({ onNext }: AdditionalNotesProps) {
  const { answers, setHealthAnswers } = useStore();
  const [notes, setNotes] = useState<string>(
    answers.health?.additionalNotes ?? ''
  );

  useEffect(() => {
    setHealthAnswers({
      goals: answers.health?.goals ?? [],
      additionalNotes: notes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, setHealthAnswers]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARACTERS) {
      setNotes(value);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Observaciones adicionales</h2>
        <p className="text-gray-600 mt-2">
          ¿Hay algo más que debamos saber?
        </p>
      </div>

      {/* Textarea */}
      <div className="space-y-2">
        <textarea
          value={notes}
          onChange={handleChange}
          placeholder="Ej: Tengo diabetes tipo 2, prefiero comidas que se puedan preparar la noche anterior, mi hijo no come verduras verdes..."
          rows={5}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-all resize-none text-gray-900 placeholder:text-gray-400"
        />
        <div className="text-right">
          <span className={`text-sm ${notes.length >= MAX_CHARACTERS ? 'text-red-500' : 'text-gray-500'}`}>
            {notes.length}/{MAX_CHARACTERS} caracteres
          </span>
        </div>
      </div>

      {/* Info card */}
      <Card className="bg-green-50 border-green-200 p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-green-700">
            Esta información nos ayudará a crear un plan totalmente personalizado para ti
          </p>
        </div>
      </Card>
    </div>
  );
}
