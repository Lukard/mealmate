/**
 * AI API Client
 * Client for AI-powered features (meal plan generation, etc.)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// ============================================
// Types
// ============================================

export type HealthGoal =
  | 'weight-loss'
  | 'high-protein'
  | 'low-sugar'
  | 'high-fiber'
  | 'heart-healthy'
  | 'low-carb'
  | 'whole-foods'
  | 'balanced';

export interface GenerateMealPlanRequest {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  preferences?: {
    includeBreakfast?: boolean;
    includeLunch?: boolean;
    includeDinner?: boolean;
    includeSnacks?: boolean;
    variety?: 'low' | 'medium' | 'high';
    preferQuickMeals?: boolean;
    maxPrepTime?: number;
    budgetLimit?: number;
    mealPrepFriendly?: boolean;
  };
  context?: {
    occasion?: string;
    cuisineFocus?: string[];
    excludeRecipes?: string[];
    includeRecipes?: string[];
  };
  health?: {
    goals: HealthGoal[];
    additionalNotes: string;
  };
}

export interface MealPlanEntry {
  id: string;
  date: string;
  mealType: string;
  recipeId?: string;
  recipeName?: string;
  description?: string;
  prepTime?: number;
  servings?: number;
  ingredients?: string[];
  instructions?: string[];
  notes?: string;
}

export interface GeneratedMealPlan {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  aiExplanation: string;
  entries: MealPlanEntry[];
}

export interface AIMetadata {
  provider: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
}

export interface GenerateMealPlanResponse {
  success: boolean;
  data?: {
    mealPlan: GeneratedMealPlan;
    aiExplanation: string;
  };
  metadata?: AIMetadata;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface AIStatusResponse {
  success: boolean;
  data: {
    available: boolean;
    provider: string;
    model: string;
    features: {
      mealPlanGeneration: boolean;
      recipeRecommendations: boolean;
      ingredientSubstitution: boolean;
    };
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get auth token from storage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Make authenticated request to API
 */
async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new AIApiError(
      data.error?.message || 'Request failed',
      data.error?.code || 'UNKNOWN_ERROR',
      response.status,
      data.error?.details
    );
  }

  return data;
}

// ============================================
// Custom Error Class
// ============================================

export class AIApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'AIApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// ============================================
// AI API Client
// ============================================

export const aiApi = {
  /**
   * Generate a meal plan using AI
   * @param request - Generation parameters
   * @returns Generated meal plan with AI explanation
   */
  async generateMealPlan(request: GenerateMealPlanRequest): Promise<GenerateMealPlanResponse> {
    return fetchWithAuth<GenerateMealPlanResponse>('/ai/meal-plans/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Check AI service status
   * @returns AI service availability and features
   */
  async getStatus(): Promise<AIStatusResponse> {
    return fetchWithAuth<AIStatusResponse>('/ai/status');
  },
};

// ============================================
// React Hook (Optional - if using React Query or similar)
// ============================================

/**
 * Helper to get date range for current/next week
 */
export function getWeekDateRange(weeksFromNow: number = 0): { startDate: string; endDate: string } {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  
  const startDate = new Date(today);
  startDate.setDate(today.getDate() + daysUntilMonday + (weeksFromNow * 7));
  
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export default aiApi;
