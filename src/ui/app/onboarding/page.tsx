'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui';
import {
  StepIndicator,
  HouseholdSize,
  DietaryPreferences,
  BudgetRange,
  MealFrequency,
  CuisinePreferences,
  HealthGoals,
  AdditionalNotes,
} from '@/components/questionnaire';
import { useStore, type QuestionnaireAnswers } from '@/lib/store';
import { api } from '@/lib/api';

const steps = [
  { number: 1, title: 'Hogar' },
  { number: 2, title: 'Dieta' },
  { number: 3, title: 'Presupuesto' },
  { number: 4, title: 'Comidas' },
  { number: 5, title: 'Preferencias' },
  { number: 6, title: 'Salud' },
  { number: 7, title: 'Detalles' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { currentStep, nextStep, prevStep, setStep, answers, completeQuestionnaire, setMealPlan, setGroceryList } = useStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = async () => {
    if (currentStep < 7) {
      nextStep();
    } else {
      // Generate meal plan
      await handleGeneratePlan();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      prevStep();
    }
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Ensure all answers are complete
      const completeAnswers: QuestionnaireAnswers = {
        household: answers.household ?? { adults: 2, children: 0 },
        dietary: answers.dietary ?? [],
        budget: answers.budget ?? { weeklyBudget: 100, preferCheaper: false },
        schedule: answers.schedule ?? { meals: ['breakfast', 'lunch', 'dinner'], maxPrepTimeMinutes: 45 },
        preferences: answers.preferences ?? { cuisines: [], cookingSkill: 'intermediate', avoidIngredients: [] },
        health: answers.health ?? { goals: [], additionalNotes: '' },
      };

      // Generate meal plan
      const mealPlan = await api.generateMealPlan(completeAnswers);
      setMealPlan(mealPlan);

      // Generate grocery list
      const groceryList = await api.generateGroceryList(mealPlan.id);
      setGroceryList(groceryList);

      // Mark questionnaire as complete
      completeQuestionnaire();

      // Navigate to meal plan page
      router.push('/meal-plan');
    } catch (err) {
      setError('Ha ocurrido un error generando tu plan. Por favor, intentalo de nuevo.');
      console.error('Error generating plan:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <HouseholdSize onNext={handleNext} />;
      case 2:
        return <DietaryPreferences onNext={handleNext} />;
      case 3:
        return <BudgetRange onNext={handleNext} />;
      case 4:
        return <MealFrequency onNext={handleNext} />;
      case 5:
        return <CuisinePreferences onNext={handleNext} />;
      case 6:
        return <HealthGoals onNext={handleNext} />;
      case 7:
        return <AdditionalNotes onNext={handleNext} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Volver</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900">PlanificaMenu</span>
          </div>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Step indicator */}
        <StepIndicator steps={steps} currentStep={currentStep} />

        {/* Step content with animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex gap-4">
          {currentStep > 1 && (
            <Button
              variant="secondary"
              onClick={handleBack}
              disabled={isGenerating}
              className="flex-1"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Anterior
            </Button>
          )}
          <Button
            onClick={handleNext}
            isLoading={isGenerating}
            className="flex-1"
          >
            {currentStep === 7 ? (
              isGenerating ? (
                'Generando tu plan...'
              ) : (
                <>
                  Generar mi plan
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )
            ) : (
              <>
                Siguiente
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </Button>
        </div>

        {/* Skip option for non-required steps */}
        {currentStep > 1 && currentStep < 7 && (
          <button
            onClick={handleNext}
            className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Saltar este paso
          </button>
        )}
      </main>
    </div>
  );
}
