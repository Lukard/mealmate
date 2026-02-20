# Plan: Feature "Cambiar Receta"

**Fecha:** 2025-01-20  
**Estado:** PLANIFICACIÓN  
**Prioridad:** Alta  

---

## 📋 Resumen Ejecutivo

Esta feature permite al usuario cambiar una comida específica del menú semanal por otra alternativa generada por IA, respetando sus preferencias del cuestionario (dietary, health goals, cuisine, etc.) y actualizando automáticamente la lista de la compra.

---

## 🔍 Análisis del Estado Actual

### Componentes Existentes

| Archivo | Descripción | Relevancia |
|---------|-------------|------------|
| `RecipeModal.tsx` | Modal que muestra detalles de una receta | ✅ **Ya tiene botón "Cambiar receta"** (sin funcionalidad) |
| `WeeklyCalendar.tsx` | Calendario semanal con las comidas | Dispara `onMealClick` → abre RecipeModal |
| `meal-plan/page.tsx` | Página principal del plan | Gestiona estado de selectedMeal (day, mealType) |
| `store.ts` | Estado global con Zustand | Tiene `setMealPlan` (completo), **falta** `updateMeal` |
| `api/ai.ts` | Cliente API para IA | Tiene `generateMealPlan`, **falta** `getRecipeAlternatives` |
| `api/v1/ai/meal-plans/generate/route.ts` | Endpoint generación | Genera plan completo, **falta** endpoint alternativas |

### Hallazgo Clave

El botón "Cambiar receta" ya existe en `RecipeModal.tsx` (línea ~170):
```tsx
<Button fullWidth>
  Cambiar receta
</Button>
```
Solo necesita conectarse con la lógica.

---

## 🎯 Diseño de la Solución

### Arquitectura General

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  RecipeModal    │────▶│ SwapRecipeModal  │────▶│ API /alternatives│
│  (Cambiar btn)  │     │ (lista opciones) │     │ (genera 3-5)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │ store.updateMeal │
                        │ + regenerar      │
                        │   groceryList    │
                        └──────────────────┘
```

### Flujo de Usuario

1. Usuario ve su plan semanal en `WeeklyCalendar`
2. Hace clic en una receta → se abre `RecipeModal`
3. Hace clic en **"Cambiar receta"** → se abre `SwapRecipeModal`
4. Ve 3-5 alternativas generadas por IA (con loading state)
5. Selecciona una alternativa
6. La receta se actualiza en el plan
7. La lista de la compra se regenera automáticamente

---

## 📁 Archivos a Crear/Modificar

### 1. Nuevo Endpoint API

**Crear:** `src/ui/app/api/v1/ai/recipes/alternatives/route.ts`

```typescript
// POST /api/v1/ai/recipes/alternatives
interface AlternativesRequest {
  currentRecipe: {
    name: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  };
  userPreferences: {
    dietary: string[];           // Del cuestionario
    healthGoals: string[];       // Del cuestionario
    cuisines: string[];          // Del cuestionario
    maxPrepTime: number;         // Del cuestionario
    avoidIngredients: string[];  // Del cuestionario
  };
  count?: number;  // Número de alternativas (default: 4)
}

interface AlternativesResponse {
  success: boolean;
  data: {
    alternatives: Array<{
      id: string;
      name: string;
      description: string;
      prepTimeMinutes: number;
      servings: number;
      ingredients: string[];
      instructions: string[];
      whyRecommended: string;  // "Más rápido", "Menos calorías", etc.
    }>;
    aiExplanation: string;
  };
}
```

**System Prompt para Groq:**
```
Eres un nutricionista experto. El usuario quiere cambiar una receta de su plan.
Genera {count} alternativas que:
1. Sean del mismo tipo de comida ({mealType})
2. Respeten las restricciones dietéticas: {dietary}
3. Alineen con los objetivos de salud: {healthGoals}
4. Prefieran cocinas: {cuisines}
5. No superen {maxPrepTime} minutos
6. Eviten: {avoidIngredients}

Para cada alternativa, explica brevemente por qué es buena opción.
```

### 2. Actualizar Cliente API

**Modificar:** `src/ui/lib/api/ai.ts`

Añadir:
```typescript
export interface RecipeAlternative {
  id: string;
  name: string;
  description: string;
  prepTimeMinutes: number;
  servings: number;
  ingredients: string[];
  instructions: string[];
  whyRecommended: string;
}

export interface GetAlternativesRequest {
  currentRecipeName: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  count?: number;
}

export interface GetAlternativesResponse {
  success: boolean;
  data?: {
    alternatives: RecipeAlternative[];
    aiExplanation: string;
  };
  error?: { code: string; message: string };
}

// En aiApi object:
async getRecipeAlternatives(
  request: GetAlternativesRequest, 
  userAnswers: QuestionnaireAnswers
): Promise<GetAlternativesResponse> {
  return fetchWithAuth<GetAlternativesResponse>('/ai/recipes/alternatives', {
    method: 'POST',
    body: JSON.stringify({
      currentRecipe: {
        name: request.currentRecipeName,
        mealType: request.mealType,
      },
      userPreferences: {
        dietary: userAnswers.dietary || [],
        healthGoals: userAnswers.health?.goals || [],
        cuisines: userAnswers.preferences?.cuisines || [],
        maxPrepTime: userAnswers.schedule?.maxPrepTimeMinutes || 45,
        avoidIngredients: userAnswers.preferences?.avoidIngredients || [],
      },
      count: request.count || 4,
    }),
  });
}
```

### 3. Actualizar Store

**Modificar:** `src/ui/lib/store.ts`

Añadir nueva acción:
```typescript
// En la interfaz AppState:
updateMeal: (
  day: DayOfWeek, 
  mealType: MealType, 
  newMeal: MealItem
) => void;

// En el store:
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
```

### 4. Nuevo Componente Modal

**Crear:** `src/ui/components/meal-plan/SwapRecipeModal.tsx`

```typescript
interface SwapRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMeal: MealItem;
  mealType: MealType;
  day: DayOfWeek;
  onSwap: (newMeal: MealItem) => void;
}

// Estados del componente:
// - loading: Generando alternativas
// - error: Error al generar
// - success: Mostrando alternativas
// - swapping: Aplicando cambio
```

**UI del componente:**
```
┌────────────────────────────────────────────┐
│  🔄 Cambiar receta                      ✕  │
├────────────────────────────────────────────┤
│  Receta actual: [Tortilla Española]        │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ 🥗 Ensalada César              25min │  │
│  │ "Más ligera y rápida de preparar"    │  │
│  │                        [Seleccionar] │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ 🍳 Huevos revueltos con verduras 15m │  │
│  │ "Alto en proteína, bajo en carbos"   │  │
│  │                        [Seleccionar] │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ 🥙 Wrap de pollo                 20m │  │
│  │ "Equilibrado y fácil de transportar" │  │
│  │                        [Seleccionar] │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  [🔄 Generar más opciones]    [Cancelar]   │
└────────────────────────────────────────────┘
```

### 5. Conectar RecipeModal

**Modificar:** `src/ui/components/meal-plan/RecipeModal.tsx`

Cambios:
1. Añadir props: `day: DayOfWeek`, `onSwapClick: () => void`
2. Conectar el botón existente:
```tsx
<Button fullWidth onClick={onSwapClick}>
  Cambiar receta
</Button>
```

### 6. Actualizar Página Principal

**Modificar:** `src/ui/app/meal-plan/page.tsx`

Cambios:
1. Añadir estado para SwapRecipeModal
2. Añadir handler para swap
3. Regenerar grocery list después del swap

```typescript
const [showSwapModal, setShowSwapModal] = useState(false);

const handleSwapRecipe = (newMeal: MealItem) => {
  if (selectedMeal) {
    updateMeal(selectedMeal.day, selectedMeal.mealType, newMeal);
    setShowSwapModal(false);
    setSelectedMeal(null);
    // Opcional: mostrar toast de éxito
  }
};

// Después del swap, regenerar grocery list:
useEffect(() => {
  if (currentMealPlan && !groceryList) {
    api.generateGroceryList(currentMealPlan.id).then(setGroceryList);
  }
}, [currentMealPlan, groceryList]);
```

---

## 🔧 Consideraciones Técnicas

### Loading States

| Estado | UI |
|--------|-----|
| Cargando alternativas | Spinner + "Buscando opciones..." |
| Error generación | Mensaje + botón "Reintentar" |
| Sin alternativas | "No encontramos alternativas. Intenta con otros criterios." |
| Aplicando cambio | Botón disabled + spinner |

### Manejo de Errores

```typescript
try {
  const response = await aiApi.getRecipeAlternatives(request, answers);
  if (!response.success) {
    throw new Error(response.error?.message || 'Error desconocido');
  }
  setAlternatives(response.data.alternatives);
} catch (error) {
  if (error instanceof AIApiError) {
    // Error de API (rate limit, no disponible, etc.)
    setError(error.message);
  } else {
    setError('No se pudieron cargar las alternativas');
  }
}
```

### Cache y Optimización

1. **No cachear alternativas**: Siempre generar frescas para variedad
2. **Debounce**: Si el usuario hace clic rápido en "Generar más", evitar múltiples llamadas
3. **Prefetch**: Opcionalmente, pre-cargar alternativas al abrir RecipeModal (bajo prioridad)

### Actualización de Grocery List

Dos opciones:

**Opción A: Regenerar completa (recomendada)**
```typescript
// Al cambiar receta, invalidar grocery list
groceryList: null
// Luego regenerar
await api.generateGroceryList(mealPlanId);
```

**Opción B: Actualización incremental** (más compleja)
```typescript
// Calcular diff de ingredientes
const oldIngredients = oldMeal.ingredients;
const newIngredients = newMeal.ingredients;
// Actualizar cantidades...
```

→ **Recomendación:** Opción A por simplicidad. La regeneración es rápida.

---

## 📊 Estructura Final de Archivos

```
src/ui/
├── app/
│   ├── api/v1/ai/
│   │   ├── meal-plans/generate/route.ts  (existente)
│   │   └── recipes/
│   │       └── alternatives/
│   │           └── route.ts              ← CREAR
│   └── meal-plan/
│       └── page.tsx                      ← MODIFICAR
├── components/meal-plan/
│   ├── RecipeModal.tsx                   ← MODIFICAR
│   ├── SwapRecipeModal.tsx               ← CREAR
│   ├── AlternativeCard.tsx               ← CREAR (opcional)
│   └── index.ts                          ← MODIFICAR (export)
└── lib/
    ├── api/
    │   └── ai.ts                         ← MODIFICAR
    └── store.ts                          ← MODIFICAR
```

---

## ✅ Checklist de Implementación

### Fase 1: Backend
- [ ] Crear endpoint `/api/v1/ai/recipes/alternatives/route.ts`
- [ ] Añadir tipos en `api/ai.ts`
- [ ] Añadir método `getRecipeAlternatives` en `aiApi`
- [ ] Probar endpoint con curl/Postman

### Fase 2: Store
- [ ] Añadir acción `updateMeal` en store
- [ ] Verificar que invalida `groceryList`
- [ ] Añadir tipo `DayOfWeek` al export del store

### Fase 3: UI
- [ ] Crear `SwapRecipeModal.tsx`
- [ ] Crear `AlternativeCard.tsx` (componente para cada opción)
- [ ] Modificar `RecipeModal.tsx` (añadir props y handler)
- [ ] Modificar `page.tsx` (integrar todo)

### Fase 4: Polish
- [ ] Loading states
- [ ] Error handling
- [ ] Animaciones de transición
- [ ] Toast de confirmación
- [ ] Regenerar grocery list automáticamente

### Fase 5: Testing
- [ ] Test unitario de `updateMeal`
- [ ] Test de integración del endpoint
- [ ] Test E2E del flujo completo

---

## 🚀 Estimación

| Fase | Tiempo estimado |
|------|-----------------|
| Fase 1: Backend | 2-3 horas |
| Fase 2: Store | 30 min |
| Fase 3: UI | 3-4 horas |
| Fase 4: Polish | 1-2 horas |
| Fase 5: Testing | 1-2 horas |
| **Total** | **8-12 horas** |

---

## 📝 Notas Adicionales

1. **Prompt Engineering**: El prompt para generar alternativas es crítico. Considerar iterar basándose en la calidad de las respuestas.

2. **Fallback**: Si la IA falla, considerar tener un set de recetas predefinidas por categoría como fallback.

3. **Analytics**: Trackear qué tan seguido los usuarios cambian recetas y qué alternativas eligen para mejorar el algoritmo.

4. **Futuro**: Esta feature abre la puerta a:
   - "No me gusta ninguna" → regenerar con exclusiones
   - "Más opciones como esta" → recomendar similares
   - Historial de cambios para no repetir rechazos
