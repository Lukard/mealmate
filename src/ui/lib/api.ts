import type {
  QuestionnaireAnswers,
  WeeklyMealPlan,
  GroceryList,
  MealItem,
  DayPlan
} from './store';
import { aiApi, getWeekDateRange } from './api/ai';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// API client for backend communication
export const api = {
  // Generate meal plan from questionnaire answers using AI
  async generateMealPlan(answers: QuestionnaireAnswers): Promise<WeeklyMealPlan> {
    try {
      // Get next week's date range
      const { startDate, endDate } = getWeekDateRange(0);
      
      // Call AI API with user preferences
      const response = await aiApi.generateMealPlan({
        startDate,
        endDate,
        preferences: {
          includeBreakfast: answers.schedule.meals.includes('breakfast'),
          includeLunch: answers.schedule.meals.includes('lunch'),
          includeDinner: answers.schedule.meals.includes('dinner'),
          includeSnacks: answers.schedule.meals.includes('snack'),
          variety: 'high',
          maxPrepTime: answers.schedule.maxPrepTimeMinutes || 45,
          budgetLimit: answers.budget.weeklyBudget,
        },
        context: {
          cuisineFocus: answers.preferences.cuisines,
        },
      });

      if (!response.success || !response.data?.mealPlan) {
        throw new Error('Failed to generate meal plan');
      }

      // Transform AI response to store format
      const aiPlan = response.data.mealPlan;
      const totalPeople = answers.household.adults + answers.household.children;
      
      return transformAIPlanToStorePlan(aiPlan, totalPeople, answers);
    } catch (error) {
      console.error('AI generation failed, using fallback:', error);
      // Fallback to mock data if AI fails
      return generateMockMealPlan(answers);
    }
  },

  // Generate grocery list from meal plan
  async generateGroceryList(mealPlanId: string): Promise<GroceryList> {
    // TODO: Replace with actual API call
    // const response = await fetch(`${API_BASE_URL}/api/grocery-lists/generate/${mealPlanId}`);
    // return response.json();

    return generateMockGroceryList(mealPlanId);
  },

  // Save meal plan
  async saveMealPlan(plan: WeeklyMealPlan): Promise<{ success: boolean }> {
    // TODO: Implement when backend is ready
    return { success: true };
  },

  // Get recipe details
  async getRecipe(recipeId: string): Promise<MealItem | null> {
    // TODO: Implement when backend is ready
    return null;
  },
};

// Transform AI plan to store format
function transformAIPlanToStorePlan(
  aiPlan: { id: string; startDate: string; entries: Array<{ id: string; date: string; mealType: string; recipeName?: string; prepTime?: number; description?: string; servings?: number }> },
  totalPeople: number,
  answers: QuestionnaireAnswers
): WeeklyMealPlan {
  type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  const dayNames: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  // Create empty days structure
  const days: Record<DayOfWeek, DayPlan> = {
    monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {}, sunday: {}
  };
  
  // Map entries to days
  aiPlan.entries.forEach((entry) => {
    const entryDate = new Date(entry.date);
    const dayIndex = (entryDate.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
    const dayName = dayNames[dayIndex];
    
    const mealItem: MealItem = {
      id: entry.id || crypto.randomUUID(),
      name: entry.recipeName || 'Receta',
      description: entry.description || '',
      prepTimeMinutes: entry.prepTime || 30,
      servings: entry.servings || totalPeople,
      ingredients: [],
      instructions: [],
    };
    
    const mealType = entry.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack';
    if (days[dayName] && ['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) {
      days[dayName][mealType] = mealItem;
    }
  });
  
  return {
    id: aiPlan.id,
    weekStartDate: aiPlan.startDate,
    days,
    estimatedCost: answers.budget.weeklyBudget * 0.85,
  };
}

// Mock data generators for development (fallback)
function generateMockMealPlan(answers: QuestionnaireAnswers): WeeklyMealPlan {
  const totalPeople = answers.household.adults + answers.household.children;

  const mockMeals: Record<string, MealItem> = {
    'tortilla-espanola': {
      id: 'tortilla-espanola',
      name: 'Tortilla Espanola',
      description: 'Clasica tortilla de patatas con cebolla',
      prepTimeMinutes: 30,
      servings: totalPeople,
      imageUrl: 'https://images.unsplash.com/photo-1584278860047-22db9ff82bed?w=400',
      ingredients: ['6 huevos', '4 patatas medianas', '1 cebolla', 'Aceite de oliva', 'Sal'],
      instructions: [
        'Pelar y cortar las patatas en rodajas finas',
        'Freir las patatas con la cebolla a fuego lento',
        'Batir los huevos y mezclar con las patatas',
        'Cuajar la tortilla por ambos lados'
      ]
    },
    'gazpacho': {
      id: 'gazpacho',
      name: 'Gazpacho Andaluz',
      description: 'Sopa fria de tomate perfecta para el verano',
      prepTimeMinutes: 15,
      servings: totalPeople,
      imageUrl: 'https://images.unsplash.com/photo-1529069067548-2105b0b48b7e?w=400',
      ingredients: ['1kg tomates maduros', '1 pepino', '1 pimiento verde', 'Ajo', 'Vinagre', 'Aceite de oliva'],
      instructions: [
        'Lavar y trocear las verduras',
        'Triturar todos los ingredientes',
        'Anadir aceite, vinagre y sal al gusto',
        'Enfriar en la nevera antes de servir'
      ]
    },
    'paella': {
      id: 'paella',
      name: 'Paella Valenciana',
      description: 'Arroz tradicional valenciano con pollo y verduras',
      prepTimeMinutes: 60,
      servings: totalPeople,
      imageUrl: 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=400',
      ingredients: ['400g arroz bomba', '500g pollo', 'Judia verde', 'Garrofon', 'Azafran', 'Caldo de pollo'],
      instructions: [
        'Sofreir el pollo en la paellera',
        'Anadir las verduras y sofreir',
        'Agregar el arroz y el caldo',
        'Cocinar a fuego medio-alto sin remover'
      ]
    },
    'ensalada-mediterranea': {
      id: 'ensalada-mediterranea',
      name: 'Ensalada Mediterranea',
      description: 'Ensalada fresca con queso feta y aceitunas',
      prepTimeMinutes: 15,
      servings: totalPeople,
      ingredients: ['Lechuga', 'Tomates cherry', 'Pepino', 'Queso feta', 'Aceitunas negras', 'Aceite de oliva'],
      instructions: [
        'Lavar y cortar las verduras',
        'Mezclar en un bol grande',
        'Anadir el queso feta y las aceitunas',
        'Alinar con aceite de oliva y oregano'
      ]
    },
    'tostadas-tomate': {
      id: 'tostadas-tomate',
      name: 'Tostadas con Tomate',
      description: 'Pan con tomate tradicional catalan',
      prepTimeMinutes: 10,
      servings: totalPeople,
      ingredients: ['Pan rustico', 'Tomates maduros', 'Ajo', 'Aceite de oliva virgen extra', 'Sal'],
      instructions: [
        'Tostar el pan',
        'Frotar con ajo y tomate',
        'Rociar con aceite de oliva',
        'Anadir sal al gusto'
      ]
    },
    'crema-verduras': {
      id: 'crema-verduras',
      name: 'Crema de Verduras',
      description: 'Crema casera de verduras de temporada',
      prepTimeMinutes: 40,
      servings: totalPeople,
      ingredients: ['Calabacin', 'Puerro', 'Zanahoria', 'Patata', 'Cebolla', 'Caldo de verduras'],
      instructions: [
        'Cortar todas las verduras en trozos',
        'Cocer en caldo de verduras',
        'Triturar hasta obtener una crema suave',
        'Servir caliente con un chorrito de aceite'
      ]
    },
    'lentejas': {
      id: 'lentejas',
      name: 'Lentejas Estofadas',
      description: 'Plato tradicional de lentejas con chorizo',
      prepTimeMinutes: 50,
      servings: totalPeople,
      ingredients: ['400g lentejas', 'Chorizo', 'Zanahoria', 'Patata', 'Pimiento verde', 'Laurel'],
      instructions: [
        'Poner las lentejas en remojo (opcional)',
        'Cocer con las verduras cortadas',
        'Anadir el chorizo a mitad de coccion',
        'Dejar cocer hasta que esten tiernas'
      ]
    },
  };

  const createDayPlan = (meals: string[]): DayPlan => {
    const plan: DayPlan = {};
    const mealKeys = Object.keys(mockMeals);

    if (answers.schedule.meals.includes('breakfast')) {
      plan.breakfast = mockMeals['tostadas-tomate'];
    }
    if (answers.schedule.meals.includes('lunch')) {
      const randomIndex = Math.floor(Math.random() * mealKeys.length);
      plan.lunch = mockMeals[mealKeys[randomIndex]];
    }
    if (answers.schedule.meals.includes('dinner')) {
      const randomIndex = Math.floor(Math.random() * mealKeys.length);
      plan.dinner = mockMeals[mealKeys[randomIndex]];
    }
    if (answers.schedule.meals.includes('snack')) {
      plan.snack = mockMeals['ensalada-mediterranea'];
    }

    return plan;
  };

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);

  return {
    id: `plan-${Date.now()}`,
    weekStartDate: monday.toISOString().split('T')[0],
    days: {
      monday: createDayPlan(['tostadas-tomate', 'tortilla-espanola', 'gazpacho']),
      tuesday: createDayPlan(['tostadas-tomate', 'lentejas', 'crema-verduras']),
      wednesday: createDayPlan(['tostadas-tomate', 'paella', 'ensalada-mediterranea']),
      thursday: createDayPlan(['tostadas-tomate', 'tortilla-espanola', 'crema-verduras']),
      friday: createDayPlan(['tostadas-tomate', 'lentejas', 'gazpacho']),
      saturday: createDayPlan(['tostadas-tomate', 'paella', 'ensalada-mediterranea']),
      sunday: createDayPlan(['tostadas-tomate', 'tortilla-espanola', 'crema-verduras']),
    },
    estimatedCost: answers.budget.weeklyBudget * 0.85, // Estimate under budget
  };
}

function generateMockGroceryList(mealPlanId: string): GroceryList {
  return {
    id: `grocery-${Date.now()}`,
    mealPlanId,
    items: [
      { id: '1', name: 'Huevos (docena)', quantity: 2, unit: 'paquetes', category: 'Lacteos y huevos', checked: false, estimatedPrice: 3.50 },
      { id: '2', name: 'Patatas', quantity: 2, unit: 'kg', category: 'Verduras', checked: false, estimatedPrice: 2.40 },
      { id: '3', name: 'Cebolla', quantity: 1, unit: 'kg', category: 'Verduras', checked: false, estimatedPrice: 1.50 },
      { id: '4', name: 'Tomates', quantity: 2, unit: 'kg', category: 'Verduras', checked: false, estimatedPrice: 4.00 },
      { id: '5', name: 'Aceite de oliva virgen extra', quantity: 1, unit: 'litro', category: 'Aceites', checked: false, estimatedPrice: 8.50 },
      { id: '6', name: 'Pan rustico', quantity: 2, unit: 'unidades', category: 'Panaderia', checked: false, estimatedPrice: 3.00 },
      { id: '7', name: 'Pepino', quantity: 500, unit: 'g', category: 'Verduras', checked: false, estimatedPrice: 1.20 },
      { id: '8', name: 'Pimiento verde', quantity: 500, unit: 'g', category: 'Verduras', checked: false, estimatedPrice: 2.00 },
      { id: '9', name: 'Ajo', quantity: 2, unit: 'cabezas', category: 'Verduras', checked: false, estimatedPrice: 0.80 },
      { id: '10', name: 'Arroz bomba', quantity: 500, unit: 'g', category: 'Arroces y pasta', checked: false, estimatedPrice: 3.50 },
      { id: '11', name: 'Pollo', quantity: 1, unit: 'kg', category: 'Carnes', checked: false, estimatedPrice: 6.50 },
      { id: '12', name: 'Lentejas', quantity: 500, unit: 'g', category: 'Legumbres', checked: false, estimatedPrice: 2.00 },
      { id: '13', name: 'Chorizo', quantity: 200, unit: 'g', category: 'Embutidos', checked: false, estimatedPrice: 3.00 },
      { id: '14', name: 'Calabacin', quantity: 500, unit: 'g', category: 'Verduras', checked: false, estimatedPrice: 1.50 },
      { id: '15', name: 'Zanahoria', quantity: 500, unit: 'g', category: 'Verduras', checked: false, estimatedPrice: 1.00 },
      { id: '16', name: 'Puerro', quantity: 300, unit: 'g', category: 'Verduras', checked: false, estimatedPrice: 1.80 },
      { id: '17', name: 'Queso feta', quantity: 200, unit: 'g', category: 'Lacteos y huevos', checked: false, estimatedPrice: 3.50 },
      { id: '18', name: 'Aceitunas negras', quantity: 200, unit: 'g', category: 'Conservas', checked: false, estimatedPrice: 2.20 },
      { id: '19', name: 'Lechuga', quantity: 1, unit: 'unidad', category: 'Verduras', checked: false, estimatedPrice: 1.00 },
      { id: '20', name: 'Vinagre', quantity: 1, unit: 'botella', category: 'Condimentos', checked: false, estimatedPrice: 1.50 },
    ],
    totalEstimatedCost: 54.40,
  };
}
