'use client';

import { useState, useEffect } from 'react';
import { Card, Input } from '@/components/ui';
import { useStore, type CuisineType, type CookingSkill } from '@/lib/store';
import clsx from 'clsx';

interface CuisineOption {
  id: CuisineType;
  label: string;
  flag: string;
}

const cuisineOptions: CuisineOption[] = [
  { id: 'spanish', label: 'Espanola', flag: '🇪🇸' },
  { id: 'mediterranean', label: 'Mediterranea', flag: '🫒' },
  { id: 'italian', label: 'Italiana', flag: '🇮🇹' },
  { id: 'mexican', label: 'Mexicana', flag: '🇲🇽' },
  { id: 'asian', label: 'Asiatica', flag: '🥢' },
  { id: 'american', label: 'Americana', flag: '🇺🇸' },
  { id: 'indian', label: 'India', flag: '🇮🇳' },
  { id: 'middle-eastern', label: 'Oriente Medio', flag: '🧆' },
];

interface SkillOption {
  id: CookingSkill;
  label: string;
  description: string;
}

const skillOptions: SkillOption[] = [
  {
    id: 'beginner',
    label: 'Principiante',
    description: 'Recetas sencillas con pocos pasos',
  },
  {
    id: 'intermediate',
    label: 'Intermedio',
    description: 'Recetas variadas con tecnicas basicas',
  },
  {
    id: 'advanced',
    label: 'Avanzado',
    description: 'Recetas elaboradas y tecnicas complejas',
  },
];

interface CuisinePreferencesProps {
  onNext: () => void;
}

export function CuisinePreferences({ onNext }: CuisinePreferencesProps) {
  const { answers, setPreferencesAnswers } = useStore();
  const [selectedCuisines, setSelectedCuisines] = useState<CuisineType[]>(
    answers.preferences?.cuisines ?? []
  );
  const [cookingSkill, setCookingSkill] = useState<CookingSkill>(
    answers.preferences?.cookingSkill ?? 'intermediate'
  );
  const [avoidIngredients, setAvoidIngredients] = useState<string[]>(
    answers.preferences?.avoidIngredients ?? []
  );
  const [ingredientInput, setIngredientInput] = useState('');

  useEffect(() => {
    setPreferencesAnswers({
      cuisines: selectedCuisines,
      cookingSkill,
      avoidIngredients,
    });
  }, [selectedCuisines, cookingSkill, avoidIngredients, setPreferencesAnswers]);

  const toggleCuisine = (cuisineId: CuisineType) => {
    setSelectedCuisines((prev) => {
      if (prev.includes(cuisineId)) {
        return prev.filter((c) => c !== cuisineId);
      }
      return [...prev, cuisineId];
    });
  };

  const addIngredient = () => {
    const trimmed = ingredientInput.trim().toLowerCase();
    if (trimmed && !avoidIngredients.includes(trimmed)) {
      setAvoidIngredients((prev) => [...prev, trimmed]);
      setIngredientInput('');
    }
  };

  const removeIngredient = (ingredient: string) => {
    setAvoidIngredients((prev) => prev.filter((i) => i !== ingredient));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addIngredient();
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Tus preferencias</h2>
        <p className="text-gray-600 mt-2">
          Personaliza tus recomendaciones de comidas
        </p>
      </div>

      {/* Cuisine selection */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Tipos de cocina favoritos</h3>
        <p className="text-sm text-gray-500">
          Selecciona las cocinas que mas te gustan (puedes elegir varias)
        </p>

        <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
          {cuisineOptions.map((cuisine) => (
            <button
              key={cuisine.id}
              type="button"
              onClick={() => toggleCuisine(cuisine.id)}
              className={clsx(
                'p-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2',
                selectedCuisines.includes(cuisine.id)
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              )}
            >
              <span className="text-lg">{cuisine.flag}</span>
              <span>{cuisine.label}</span>
            </button>
          ))}
        </div>

        {selectedCuisines.length === 0 && (
          <p className="text-sm text-gray-400 text-center">
            Si no seleccionas ninguna, incluiremos todo tipo de cocinas
          </p>
        )}
      </div>

      {/* Cooking skill */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Nivel de cocina</h3>
        <p className="text-sm text-gray-500">
          Cual es tu nivel de experiencia cocinando?
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          {skillOptions.map((skill) => (
            <Card
              key={skill.id}
              hoverable
              selected={cookingSkill === skill.id}
              onClick={() => setCookingSkill(skill.id)}
              className={clsx(
                'p-4 cursor-pointer transition-all duration-200',
                cookingSkill === skill.id && 'bg-primary-50'
              )}
            >
              <div className="text-center">
                <h4 className="font-semibold text-gray-900">{skill.label}</h4>
                <p className="text-sm text-gray-500 mt-1">{skill.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Avoid ingredients */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Ingredientes a evitar</h3>
        <p className="text-sm text-gray-500">
          Anade ingredientes que no te gusten o quieras evitar (opcional)
        </p>

        <div className="flex gap-2">
          <Input
            value={ingredientInput}
            onChange={(e) => setIngredientInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej: cilantro, brocoli..."
            className="flex-1"
          />
          <button
            type="button"
            onClick={addIngredient}
            disabled={!ingredientInput.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Anadir
          </button>
        </div>

        {avoidIngredients.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {avoidIngredients.map((ingredient) => (
              <span
                key={ingredient}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
              >
                {ingredient}
                <button
                  type="button"
                  onClick={() => removeIngredient(ingredient)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <Card className="bg-green-50 border-green-200 p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-800">
              Ya casi terminamos!
            </p>
            <p className="text-sm text-green-700 mt-1">
              Con esta informacion crearemos un plan de comidas personalizado para ti
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
