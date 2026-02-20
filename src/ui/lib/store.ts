import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types for questionnaire state
export type DietaryRestriction =
  | 'none'
  | 'vegetarian'
  | 'vegan'
  | 'gluten-free'
  | 'dairy-free'
  | 'nut-free'
  | 'halal'
  | 'kosher';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type CuisineType =
  | 'spanish'
  | 'mediterranean'
  | 'italian'
  | 'mexican'
  | 'asian'
  | 'american'
  | 'indian'
  | 'middle-eastern';

export type CookingSkill = 'beginner' | 'intermediate' | 'advanced';

export type HealthGoal =
  | 'weight-loss'
  | 'high-protein'
  | 'low-sugar'
  | 'high-fiber'
  | 'heart-healthy'
  | 'low-carb'
  | 'whole-foods'
  | 'balanced';

export interface HouseholdInfo {
  adults: number;
  children: number;
}

export interface BudgetInfo {
  weeklyBudget: number; // in euros
  preferCheaper: boolean;
}

export interface ScheduleInfo {
  meals: MealType[];
  maxPrepTimeMinutes: number;
}

export interface PreferencesInfo {
  cuisines: CuisineType[];
  cookingSkill: CookingSkill;
  avoidIngredients: string[];
}

export interface HealthInfo {
  goals: HealthGoal[];
  additionalNotes: string;
}

export interface QuestionnaireAnswers {
  household: HouseholdInfo;
  dietary: DietaryRestriction[];
  budget: BudgetInfo;
  schedule: ScheduleInfo;
  preferences: PreferencesInfo;
  health: HealthInfo;
}

// Meal plan types
export interface MealItem {
  id: string;
  name: string;
  description: string;
  prepTimeMinutes: number;
  servings: number;
  imageUrl?: string;
  ingredients: string[];
  instructions: string[];
}

export interface DayPlan {
  breakfast?: MealItem;
  lunch?: MealItem;
  dinner?: MealItem;
  snack?: MealItem;
}

export interface WeeklyMealPlan {
  id: string;
  weekStartDate: string;
  days: {
    monday: DayPlan;
    tuesday: DayPlan;
    wednesday: DayPlan;
    thursday: DayPlan;
    friday: DayPlan;
    saturday: DayPlan;
    sunday: DayPlan;
  };
  estimatedCost: number;
}

// Grocery list types
export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  checked: boolean;
  estimatedPrice: number;
}

export interface GroceryList {
  id: string;
  mealPlanId: string;
  items: GroceryItem[];
  totalEstimatedCost: number;
}

// Store state interface
interface AppState {
  // Questionnaire state
  currentStep: number;
  answers: Partial<QuestionnaireAnswers>;
  isQuestionnaireComplete: boolean;

  // Meal plan state
  currentMealPlan: WeeklyMealPlan | null;

  // Grocery list state
  groceryList: GroceryList | null;

  // Actions
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setHouseholdAnswers: (household: HouseholdInfo) => void;
  setDietaryAnswers: (dietary: DietaryRestriction[]) => void;
  setBudgetAnswers: (budget: BudgetInfo) => void;
  setScheduleAnswers: (schedule: ScheduleInfo) => void;
  setPreferencesAnswers: (preferences: PreferencesInfo) => void;
  setHealthAnswers: (health: HealthInfo) => void;
  completeQuestionnaire: () => void;
  setMealPlan: (plan: WeeklyMealPlan) => void;
  setGroceryList: (list: GroceryList) => void;
  toggleGroceryItem: (itemId: string) => void;
  resetQuestionnaire: () => void;
  updateMeal: (day: DayOfWeek, mealType: MealType, newMeal: MealItem) => void;
}

const initialAnswers: Partial<QuestionnaireAnswers> = {
  household: { adults: 2, children: 0 },
  dietary: [],
  budget: { weeklyBudget: 100, preferCheaper: false },
  schedule: { meals: ['breakfast', 'lunch', 'dinner'], maxPrepTimeMinutes: 45 },
  preferences: { cuisines: [], cookingSkill: 'intermediate', avoidIngredients: [] },
  health: { goals: [], additionalNotes: '' },
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      currentStep: 1,
      answers: initialAnswers,
      isQuestionnaireComplete: false,
      currentMealPlan: null,
      groceryList: null,

      // Actions
      setStep: (step) => set({ currentStep: step }),

      nextStep: () => set((state) => ({
        currentStep: Math.min(state.currentStep + 1, 7)
      })),

      prevStep: () => set((state) => ({
        currentStep: Math.max(state.currentStep - 1, 1)
      })),

      setHouseholdAnswers: (household) => set((state) => ({
        answers: { ...state.answers, household }
      })),

      setDietaryAnswers: (dietary) => set((state) => ({
        answers: { ...state.answers, dietary }
      })),

      setBudgetAnswers: (budget) => set((state) => ({
        answers: { ...state.answers, budget }
      })),

      setScheduleAnswers: (schedule) => set((state) => ({
        answers: { ...state.answers, schedule }
      })),

      setPreferencesAnswers: (preferences) => set((state) => ({
        answers: { ...state.answers, preferences }
      })),

      setHealthAnswers: (health) => set((state) => ({
        answers: { ...state.answers, health }
      })),

      completeQuestionnaire: () => set({ isQuestionnaireComplete: true }),

      setMealPlan: (plan) => set({ currentMealPlan: plan }),

      setGroceryList: (list) => set({ groceryList: list }),

      toggleGroceryItem: (itemId) => set((state) => {
        if (!state.groceryList) return state;

        const updatedItems = state.groceryList.items.map((item) =>
          item.id === itemId ? { ...item, checked: !item.checked } : item
        );

        return {
          groceryList: { ...state.groceryList, items: updatedItems }
        };
      }),

      resetQuestionnaire: () => set({
        currentStep: 1,
        answers: initialAnswers,
        isQuestionnaireComplete: false,
        currentMealPlan: null,
        groceryList: null,
      }),

      updateMeal: (day, mealType, newMeal) => set((state) => {
        if (!state.currentMealPlan) return state;

        return {
          currentMealPlan: {
            ...state.currentMealPlan,
            days: {
              ...state.currentMealPlan.days,
              [day]: {
                ...state.currentMealPlan.days[day],
                [mealType]: newMeal,
              },
            },
          },
          // Invalidar grocery list para forzar regeneración
          groceryList: null,
        };
      }),
    }),
    {
      name: 'meal-planner-storage',
      partialize: (state) => ({
        answers: state.answers,
        isQuestionnaireComplete: state.isQuestionnaireComplete,
        currentMealPlan: state.currentMealPlan,
        groceryList: state.groceryList,
      }),
    }
  )
);
